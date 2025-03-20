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
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        content_type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        content_length: {
            type: DataTypes.BIGINT,
            allowNull: true,
        },
        etag: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        last_modified: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        server_side_encryption: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        replication_status: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        storage_class: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    }, {
        tableName: 'Metadata',
        timestamps: false,
        hooks: {
            beforeCreate: (metadata) => {
                const today = new Date();
                metadata.upload_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            },
        },
    });

    return Metadata;
};
