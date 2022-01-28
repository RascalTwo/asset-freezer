# Asset Freezer

Have you hotlinked some images, but want to download all these images locally?

Well this is the the script for you - given a project directory with HTML files containing remote absolute `src=` attributes - simply run this script and said files will be downloaded to an `assets` folder, and the attributes will be updated!

## Requirements

- A folder containing HTML files with remote absolute `src=` attributes

## Installation

```sh
npm install
```

## Usage

```sh
node asset-freezer [Source Directory] [Destination Directory]
node asset-freezer my-static-project my-static-project-frozen
```

## Explanation

This script first makes a copy of the project directory, and runs through all the files ending with `.html` - ignoring files within folders starting with `.`, like `.git` and such.

For each file it processes, it finds any `src` attributes starting with `http`, downloads the provided URL to `assets/FILENAME`, where `FILENAME` is parsed from the last path segment from the URL.
