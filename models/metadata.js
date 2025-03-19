module.exports = (sequelize, DataTypes) => {
    const Metadata = sequelize.define("Metadata", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        file_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        upload_date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        }
    }, {
        tableName: 'Metadata',
        timestamps: false,
        hooks: {
            beforeCreate: (metadata) => {
                metadata.upload_date = new Date();
            },
        },
    });

    return Metadata;
};
