const path = require('path');
const util = require('util')
const streamPipeline = util.promisify(require('stream').pipeline)

const fs = require('fs-extra');
const fetch = require('node-fetch');

/**
 * Get all filepaths of files within provided {@link directory}.
 *
 * @param {string} directory directory to get all filepaths of files in
 */
async function* getFiles(directory) {
	for (const dirent of await fs.promises.readdir(directory, { withFileTypes: true })) {
		const direntPath = path.resolve(directory, dirent.name);
		if (dirent.isDirectory()) {
			yield* getFiles(direntPath);
		} else {
			yield direntPath;
		}
	}
}

/**
 * Convert async iterable to an array of the items.
 *
 * @param {AsyncIterable<T>} iterable async iterable to convert
 * @returns {Promise<T[]>} async iterale items
 */
const asyncIterableToArray = async iterable => {
	const items = []
	for await (const item of iterable) items.push(item)
	return items;
}


const HELP_MESSAGE = `Download all hotlinked images described in HTML files, and link to them
Usage:\t [Source Directory] [Destination Directory]`

/**
 * @param {string} msg failure message
 */
function fail(msg){
	console.log(HELP_MESSAGE)
	console.error('Error:', msg)
	return process.exit(1)
}

(async () => {
	const srcRoot = process.argv[2]
	if (!srcRoot) return fail('Source path required');

	const destRoot = process.argv[3]
	if (!destRoot) return fail('Destination path required');
	const assetsDir = path.join(destRoot, 'assets');

	await fs.copy(srcRoot, destRoot, { overwrite: true })
	if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)

	const files = (await asyncIterableToArray(getFiles(destRoot)))
		.filter(path => path.endsWith('.html'))
		.filter(path => !path.split('/').some(part => part.startsWith('.')));

	for (const filepath of files){
		console.log(filepath, ': ');
		const content = (await fs.readFile(filepath)).toString();
		let frozenContent = content
		const hotlinks = new Set(content.split('src="http').slice(1).map(part => 'http' + part.split('"')[0]))
		for (const [i, hotlink] of [...hotlinks].entries()){
			console.log()
			process.stdout.write((i / hotlinks.size * 100).toFixed(0).padStart(3, ' ') + '%')
			const filename = hotlink.split('/').slice(-1)[0].split('?')[0];
			const filepath = path.join(assetsDir, filename);
			frozenContent = frozenContent.replace(hotlink, path.join('assets', filename));

			if (fs.existsSync(filepath)) continue;

			process.stdout.write(' ' + hotlink + ' -> ' + filepath);
			await streamPipeline((await fetch(hotlink)).body, fs.createWriteStream(filepath))
		}
		console.log()

		if (content !== frozenContent) {
			await fs.writeFile(filepath, frozenContent)
			console.log('Frozen');
		}
		else console.log('Left alone');
	}
})().catch(console.error)