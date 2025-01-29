module.exports = (sequelize, DataTypes) => {
    const HealthCheck = sequelize.define("HealthCheck", {
        checkId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },
        datetime: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'HealthCheck',
        timestamps: false,
        hooks: {
            beforeCreate: (healthCheck) => {
                healthCheck.datetime = new Date();
            },
        },
    });

    return HealthCheck;
}
