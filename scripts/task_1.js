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

        const candidate = files.results.find((file) => !file._postcssResult.stylelint.ignored && file._postcssResult.stylelint.stylelintError);

        return candidate?.source?.replace(path.join(__dirname, '../'), '') || null;
    } catch (e) {}

    return null;
}

async function processStyles(styleFiles) {
    const styleFilesArr = styleFiles.split(/\r?\n/);

    const candidatesArray = await Promise.all(styleFilesArr.map(processStylePath));

    return candidatesArray.filter((item) => item).join(`
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