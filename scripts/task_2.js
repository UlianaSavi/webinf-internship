const stylelint = require("stylelint");
const config = require("../.stylelintrc.json");
const path = require('path');
const fs = require('fs').promises;

async function clearIgnoreFile() {
    await fs.truncate('.stylelintignore', 0);
}

async function save(result) {
    await fs.writeFile('.stylelintignore', result);
}

function structMessage(messages = [], linesToDisable = 0) {
    return {
        rules: [...new Set(messages.map((message) => message.rule))],
        linesToDisable
    };
}

function createFileMessages(messages = []) {
    const lines = [...new Set(messages.map((message) => message?.node?.source?.start?.line || 0))];

    const byLines = lines
        .map((line) => ({ line, messages: messages.filter((message) => message?.node?.source?.start?.line === line) }))
        .sort((a, b) => a.line < b.line ? -1 : 0)
        .reduce((acc, val) => {
            const linesToDisable = (val?.messages?.at(0)?.node?.selector?.split(',\n')?.length || 0) - 1;
            acc[val.line] = structMessage(val.messages, linesToDisable);
            return acc;
        }, {});

    return byLines;
}

function deleteMessagesLine(lineToDelete, fileMessages) {
    if (lineToDelete !== 0 && !lineToDelete) {
        return fileMessages;
    }

    const lines = { ...fileMessages };

    delete lines[lineToDelete];

    const reversedFile = Object.entries(lines).reverse();

    reversedFile.forEach(([line, item]) => {
        lines[+line + 1] = item;
        delete lines[line];
    });

    return lines;
}

function addStylelintDisable(file = '', fileMessages) {
    let messages = { ...fileMessages };

    const fileLines = file.split('\n');

    let i = +Object.keys(messages).at(0);
    while (Object.keys(messages).length && i) {
        const ignoreStr = `/* stylelint-disable-next-line ${messages[i].rules.join(', ')} */`;
        
        if (messages[i].linesToDisable) {
            for (let j = 0; j < messages[i].linesToDisable; j++) {
                if (fileLines[i + j]) {
                    fileLines[i + j] = `${fileLines[i + j]} ${`/* stylelint-disable-line ${messages[i].rules.join(', ')} */`}`;
                }
            }
        }

        if ((i - 2) <= 0) {
            fileLines.unshift(ignoreStr);
        } else {
            fileLines.splice(i - 1, 0, ignoreStr);
        }

        messages = deleteMessagesLine(i, messages);
        i = +Object.keys(messages).at(0);
    }

    return fileLines.join('\n');
}

async function processFile(path = '', fileMessages) {
    if (!path || !fileMessages) {
        return false;
    }

    const fileExits = await fs.stat(path);
    if (!fileExits) {
        return false;
    }

    const file = await fs.readFile(path, 'utf-8');

    const result = addStylelintDisable(file, fileMessages);

    await fs.writeFile(path, result, 'utf-8');

    return true;
}

async function processFileErrors(styleFile) {
    try {
        const files = await stylelint.lint({ config, files: styleFile });
        fs.writeFile(path.join(__dirname, '../res.json'), JSON.stringify(files, null, 4), 'utf-8');
        const resultCheck = [];
        for (let i = 0; i < files.results.length; i++) {
            const file = files.results[i];
            const fileMessages = createFileMessages(file._postcssResult.messages);
            const result = await processFile(file.source, fileMessages);
            resultCheck.push(result);
        }

        return resultCheck.every((r) => r);
        // fs.writeFile(path.join(__dirname, '../res.json'), JSON.stringify(files.results, null, 4), 'utf-8');
    } catch (e) {console.log(e);}

    return false;
}

async function processStyles(styleFiles) {
    const styleFilesArr = styleFiles.split(/\r?\n/);

    const results = await Promise.all(styleFilesArr.map(processFileErrors));

    return results;
}

async function init() {
    const styleLintIgnore = await fs.readFile(path.join(__dirname, '../.stylelintignore'), 'utf-8');;
    await clearIgnoreFile();
    console.log('cleared!');

    await processStyles(styleLintIgnore);
    console.log('procced!');

    await save(styleLintIgnore);
}
init();