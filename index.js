
const app = require("./app");
const db = require("./models")

db.sequelize.sync().then((req) => {
    app.listen(process.env.PORT, () => {
        console.log("server running");
    });
});
