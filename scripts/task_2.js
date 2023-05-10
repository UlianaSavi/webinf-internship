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

function structMessage(messages = [], linesToDisable = 0, selectorLen = 0) {
    return {
        rules: [...new Set(messages.map((message) => message.rule))],
        linesToDisable,
        selectorLen
    };
}

function createFileMessages(messages = []) {
    const lines = [...new Set(messages.map((message) => message?.node?.source?.start?.line || 0))];

    const byLines = lines
        .map((line) => ({ line, messages: messages.filter((message) => message?.node?.source?.start?.line === line) }))
        .sort((a, b) => a.line < b.line ? -1 : 0)
        .reduce((acc, val) => {
            const linesToDisable = (val?.messages?.at(0)?.node?.selector?.split('\n')?.length - 1 || 0);
            const selectorLen = (val?.messages?.at(0)?.node?.source?.end.line - val?.messages?.at(0)?.node?.source?.start.line + 1) || 0;
            acc[val.line] = structMessage(val.messages, linesToDisable, selectorLen);
            return acc;
        }, {});

        Object.entries(byLines).forEach(([line, value]) => {
            const candidates = Object.entries(byLines).filter(([key, val]) => {
                if (value.linesToDisable && value.selectorLen) {
                    return (+line < +key && (+key < (value.selectorLen + (+line))));
                }

                return false;
            });

            if (candidates.length) {
                candidates.forEach(([itemKey, itemValue]) => {
                    byLines[line] = { ...byLines[line], rules: [...new Set([...(byLines[line]?.rules || []), ...(itemValue?.rules || [])])] };
                    delete byLines[itemKey];
                });
            }
        });

    return byLines;
}

function deleteMessagesLine(lineToDelete, fileMessages, linesToUp) {
    if (lineToDelete !== 0 && !lineToDelete) {
        return fileMessages;
    }

    const lines = { ...fileMessages };

    delete lines[lineToDelete];

    const reversedFile = Object.entries(lines).reverse();

    reversedFile.forEach(([line, item]) => {
        lines[+line + linesToUp] = item;
        delete lines[line];
    });

    return lines;
}

function addStylelintDisable(file = '', fileMessages) {
    let messages = { ...fileMessages };

    const fileLines = file.split('\n');

    let i = +Object.keys(messages).at(0);
    while (Object.keys(messages).length && i) {
        const ignoreMultiline = messages[i]?.linesToDisable > 0;
        let linesToUp = 1;
        let ignoreStr = `/* stylelint-disable-next-line ${messages[i].rules.join(', ')} */`;
        if (ignoreMultiline) {
            ignoreStr = `/* stylelint-disable ${messages[i].rules.join(', ')} */`
        }

        if ((i - 2) <= 0) {
            fileLines.unshift(ignoreStr);
        } else {
            fileLines.splice(i - 1, 0, ignoreStr);
        }

        if (ignoreMultiline) {
            linesToUp = 2;
            fileLines.splice(i + messages[i]?.selectorLen, 0, `/* stylelint-enable ${messages[i].rules.join(', ')} */`);
        }

        messages = deleteMessagesLine(i, messages, linesToUp);
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
        const resultCheck = [];
        for (let i = 0; i < files.results.length; i++) {
            const file = files.results[i];
            const fileMessages = createFileMessages(file._postcssResult.messages);
            const result = await processFile(file.source, fileMessages);
            resultCheck.push(result);
        }
        return resultCheck.every((r) => r);
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

    // await save(styleLintIgnore);
}
init();