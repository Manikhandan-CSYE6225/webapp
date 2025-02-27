packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/amazon"
    }
    googlecompute = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ami_prefix" {
  type    = string
  default = "webapp-aws-ubuntu-nodejs"
}

variable "ami_source" {
  type    = string
  default = "ami-04b4f1a9cf54c11d0"
}

variable "ami_instance" {
  type    = string
  default = "t2.micro"
}

variable "artifact_path" {
  type    = string
  default = "./webapp.zip"
}

variable "db_user" {
  type = string
}

variable "db_password" {
  type = string
}

variable "db_name" {
  type    = string
  default = "csye6225"
}

variable "db_host" {
  type    = string
  default = "localhost"
}

variable "port" {
  type    = string
  default = "8080"
}

variable "dialect" {
  type    = string
  default = "mysql"
}


variable "ami_users" {
  type        = list(string)
  description = "List of AWS account IDs that can access the AMI"
  default     = []
}

variable "gcp_project_id" {
  type = string
}

variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}

variable "gcp_image_name" {
  type    = string
  default = "webapp-ubuntu-nodejs"
}

variable "gcp_source_image" {
  type    = string
  default = "ubuntu-2404-noble-amd64-v20250214"
}

variable "gcp_source_family" {
  type    = string
  default = "ubuntu-2404-lts-noble"
}

locals {
  timestamp = regex_replace(timestamp(), "[- TZ:]", "")
}

source "amazon-ebs" "ubuntu_nodejs" {
  ami_name      = "${var.ami_prefix}-${local.timestamp}"
  instance_type = var.ami_instance
  region        = var.aws_region
  source_ami    = var.ami_source
  ssh_username  = "ubuntu"
  ami_users     = var.ami_users
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 8
    volume_type           = "gp2"
    delete_on_termination = true
  }
}

source "googlecompute" "ubuntu_nodejs" {
  project_id          = var.gcp_project_id
  source_image        = var.gcp_source_image
  source_image_family = var.gcp_source_family
  zone                = var.gcp_zone
  image_name          = "${var.gcp_image_name}-${local.timestamp}"
  ssh_username        = "ubuntu"
  machine_type        = "e2-micro"
  disk_size           = 10
  disk_type           = "pd-standard"
}

build {
  name = "packer-ubuntu"
  sources = [
    "source.amazon-ebs.ubuntu_nodejs",
    "source.googlecompute.ubuntu_nodejs"
  ]

  provisioner "file" {
    source      = var.artifact_path
    destination = "/tmp/webapp.zip"
  }

  provisioner "shell" {
    inline = [
      "sudo apt update",
      "sudo apt upgrade -y",
      "sudo apt install -y nodejs",
      "sudo apt install -y npm",
      "sudo apt install -y mysql-server",
      "sudo apt install -y unzip",

      # Configure MySQL securely
      "sudo systemctl enable mysql",
      "sudo systemctl start mysql",

      # Initial MySQL setup - using debian-sys-maint credentials
      "sudo mysql_secure_installation <<EOF\n\nn\ny\ny\ny\ny\ny\nEOF",

      # Set root password and create database using debian-sys-maint
      "DEBIAN_SYS_MAINT_PASS=$(sudo grep password /etc/mysql/debian.cnf | head -n 1 | awk '{print $3}')",
      "DEBIAN_SYS_MAINT_PASS=$(sudo grep password /etc/mysql/debian.cnf | head -n 1 | awk '{print $3}')",
      "sudo mysql -u debian-sys-maint -p\"$DEBIAN_SYS_MAINT_PASS\" <<EOF\n",
      "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${var.db_password}';\n",
      "FLUSH PRIVILEGES;\n",
      "CREATE DATABASE IF NOT EXISTS ${var.db_name};\n",
      "CREATE USER IF NOT EXISTS '${var.db_user}'@'${var.db_host}' IDENTIFIED BY '${var.db_password}';\n",
      "GRANT ALL PRIVILEGES ON ${var.db_name}.* TO '${var.db_user}'@'${var.db_host}';\n",
      "DELETE FROM mysql.user WHERE User='';\n",
      "DELETE FROM mysql.user WHERE User='${var.db_user}' AND Host NOT IN ('localhost', '127.0.0.1', '::1');\n",
      "DROP DATABASE IF EXISTS test;\n",
      "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';\n",
      "FLUSH PRIVILEGES;\n",
      "EOF",
      "sudo groupadd csye6225",
      "sudo useradd -r -s /usr/sbin/nologin -g csye6225 csye6225 || true",
      "sudo mkdir -p /opt/csye6225/webapp",
      "sudo unzip -o /tmp/webapp.zip -d /opt/csye6225/webapp",
      "echo 'DB_PASSWORD_DEV=${var.db_password}' | sudo tee /opt/csye6225/webapp/.env > /dev/null",
      "echo 'DB_NAME_DEV=${var.db_name}' | sudo tee -a /opt/csye6225/webapp/.env > /dev/null",
      "echo 'DB_USERNAME_DEV=${var.db_user}' | sudo tee -a /opt/csye6225/webapp/.env > /dev/null",
      "echo 'DB_HOST_DEV=${var.db_host}' | sudo tee -a /opt/csye6225/webapp/.env > /dev/null",
      "echo 'DB_DIALECT_DEV=${var.dialect}' | sudo tee -a /opt/csye6225/webapp/.env > /dev/null",
      "echo 'PORT=${var.port}' | sudo tee -a /opt/csye6225/webapp/.env > /dev/null",
      "sudo chown -R csye6225:csye6225 /opt/csye6225/webapp",
      "sudo chmod -R 750 /opt/csye6225/webapp",
      "sudo npm install --prefix /opt/csye6225/webapp",
      "sudo mv /opt/csye6225/webapp/service/webapp.service /etc/systemd/system/webapp.service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable webapp.service"
    ]

  }
}
