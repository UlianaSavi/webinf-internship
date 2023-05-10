const stylelint = require("stylelint");
const config = require("../.stylelintrc.json");
const path = require('path');
const fs = require('fs').promises;

async function clear() {
    await fs.truncate('.stylelintignore', 0);
}

async function save(result) {
    await fs.writeFile('.stylelintignore', result);
}

async function processStylePath(styleFile) {
    try {
        const files = await stylelint.lint({ config, files: styleFile });

        const candidates = files.results
            .filter((file) => file.errored )
            .map((candidate) => candidate?.source?.replace(path.join(__dirname, '../'), '').replace(/\\/g, '/'));
        
        return candidates || null;
    } catch (e) {}

    return null;
}

async function tryToPackFolder(filesArray = []) {
    const getFiles = async (folder, files_ = []) => {
        let newFiles = [...files_];
        const files = await fs.readdir(folder);
        for (let i in files) {
            const name = folder + '\\' + files[i];
            const stat = await fs.stat(name);
            if (stat.isDirectory()) {
                newFiles = await getFiles(name, newFiles);
            } else {
                newFiles.push(name);
            }
        }
        return newFiles;
    };

    const allFiles = await getFiles(path.join(__dirname, '../src/components/'));
    const clearedFiles = allFiles
        .map(item => item.replace(path.join(__dirname, '../'), '').replace(/\\\\/g, '\\').replace(/\\/g, '/'))
        .map((item) => item.split('/'));
    const clearedIgnoredFiles = filesArray.map((item) => item.split('/'));

    const actualFilesByFolder = clearedFiles.reduce((acc, val) => {
        if (val[2]) {
            acc[val[2]] = clearedFiles.filter((item) => item[2] && item[2] === val[2])?.length || 0;
        }
        return acc;
    }, {});

    const ignoredFilesByFolder = clearedIgnoredFiles.reduce((acc, val) => {
        if (val[2]) {
            acc[val[2]] = clearedIgnoredFiles.filter((item) => item[2] && item[2] === val[2])?.length || 0;
        }
        return acc;
    }, {}) || {};

    const foldersToSquash = [];

    Object.keys(ignoredFilesByFolder).forEach((key) => {
        if ((actualFilesByFolder[key] === ignoredFilesByFolder[key]) && actualFilesByFolder[key] !== 1) {
            foldersToSquash.push(key);
        }
    });

    let result = [...clearedIgnoredFiles];

    foldersToSquash.forEach((item) => {
        const itemIndex = result.findIndex((clearedItem) => clearedItem.includes(item));
        if (!result[itemIndex]) {
            return;
        }
        const candidate = [...[...result[itemIndex]].splice(0,3), '**/*.css'];
        result = result.filter((clearedItem) => !clearedItem.includes(item));
        result.splice(itemIndex, 0, candidate);
    });
    
    return result.map(i => i.join('/'));
}

async function processStyles(styleFiles) {
    const styleFilesArr = styleFiles.split(/\r?\n/);

    const candidatesArray = await Promise.all(styleFilesArr.map(processStylePath));

    const filesArray = candidatesArray.flat().filter((item) => item);

    const foldersArray = await tryToPackFolder(filesArray);

    return foldersArray.join(`
`);
}

async function init() {
    const styleLintIgnore = await fs.readFile(path.join(__dirname, '../.stylelintignore'), 'utf-8');

    await clear();
    console.log('cleared!');

    const result = await processStyles(styleLintIgnore);
    console.log('procced!');

    await save(result);
    console.log('finish!');
    console.log(`styleLintIgnore length at start: ${styleLintIgnore.split(/\r?\n/).length}\nStyleLintIgnore length after lint and regexp: ${result.split(/\r?\n/).length}`);
}
init();