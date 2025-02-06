#!/bin/bash

# Function to print error message and exit
function error_exit {
  echo "$1" 1>&2
  exit 1
}

# Update package lists
echo "Updating package lists..."
sudo apt update || error_exit "Failed to update package lists."

# Upgrade packages
echo "Upgrading packages..."
sudo apt upgrade -y || error_exit "Failed to upgrade packages."

# Install Node.js and npm
echo "Installing Node.js and npm..."
sudo apt install -y nodejs npm || error_exit "Failed to install Node.js and npm."

sudo apt install -y unzip

# Install MySQL
echo "Installing MySQL..."
sudo apt install mysql-server -y || error_exit "Failed to install MySQL."
sudo systemctl start mysql
sudo systemctl enable mysql

# Create a new Linux group
sudo groupadd csye6225 || error_exit "Failed to create group csye6225."

echo "Group csye6225 created successfully."

# Create a new Linux user
sudo useradd -m -g csye6225 webapp || error_exit "Failed to create user webapp."

echo "User webapp created successfully."

sudo mkdir -p /opt/csye6225
sudo unzip -o /tmp/webapp.zip -d /opt/csye6225 || error_exit "Failed to unzip application."

echo "Application unzipped to /opt/csye6225."

# Update permissions
sudo chown -R webapp:csye6225 /opt/csye6225 || error_exit "Failed to change ownership."
sudo chmod -R 750 /opt/csye6225/webapp || error_exit "Failed to update permissions."

export $(grep -v '^#' /opt/csye6225/webapp/.env | xargs)
echo -e "[client]\nuser=$DB_USERNAME_DEV\npassword=$DB_PASSWORD_DEV" > ~/.my.cnf
chmod 600 ~/.my.cnf
sudo mysql -u root -e "CREATE DATABASE $DB_NAME_DEV;"
sudo systemctl restart mysql
sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"

# Start the Node.js application
echo "Starting the Node.js application..."
cd /opt/csye6225/webapp
npm install
sudo -u webapp nohup node index.js  || error_exit "Failed to start the Node.js application."

echo "Node.js application is running."

echo "Setup completed successfully."