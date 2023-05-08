const stylelint = require("stylelint");

stylelint
    .lint({
        config: { rules: "color-function-notation" },
        files: "**/*.css"
    })
    .then((data) => {
        console.log('data', data);
    })
    .catch((err) => {
        console.error('123', err.stack);
    });
