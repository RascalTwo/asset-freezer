const path = require('path');
const util = require('util')
const streamPipeline = util.promisify(require('stream').pipeline)

const fs = require('fs-extra');
const fetch = require('node-fetch');

async function* getFiles(dir) {
	const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
	for (const dirent of dirents) {
		const res = path.resolve(dir, dirent.name);
		if (dirent.isDirectory()) {
			yield* getFiles(res);
		} else {
			yield res;
		}
	}
}

const asyncIteratorToArray = async iterator => {
	const items = []
	for await (const item of iterator) items.push(item)
	return items;
}

(async () => {
	console.log('Download all hotlinked images described in HTML files, and link to them')
	console.log('Usage:\t [Source Directory] [Destination Directory]')
	const srcRoot = process.argv[2]
	if (!srcRoot) {
		console.error('Source path required');
		process.exit(1);
	}

	const destRoot = process.argv[3]
	if (!destRoot) {
		console.error('Destination path required');
		process.exit(1);
	}
	const assetsDir = path.join(destRoot, 'assets');

	await fs.copy(srcRoot, destRoot, { overwrite: true })

	const files = (await asyncIteratorToArray(getFiles(destRoot)))
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