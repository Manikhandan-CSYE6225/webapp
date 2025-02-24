packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ami_prefix" {
  type    = string
  default = "packer-aws-ubuntu-nodejs"
}

variable "artifact_path" {
  type    = string
  default = "./webapp.zip"
}

variable "db_user" {
  type    = string
  default = "root"
}

variable "db_password" {
  type    = string
  default = "password"
}

variable "db_name" {
  type    = string
  default = "csye6225"
}

variable "db_host" {
  type    = string
  default = "localhost"
}

variable "ami_users" {
  type        = list(string)
  description = "List of AWS account IDs that can access the AMI"
  default     = ["430118854533"]
}

locals {
  timestamp = regex_replace(timestamp(), "[- TZ:]", "")
}

source "amazon-ebs" "ubuntu_nodejs" {
  ami_name      = "${var.ami_prefix}-${local.timestamp}"
  instance_type = "t2.micro"
  profile       = "dev"
  region        = var.aws_region
  source_ami    = "ami-04b4f1a9cf54c11d0"
  ssh_username = "ubuntu"
  ami_users                = var.ami_users
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 8
    volume_type           = "gp2"
    delete_on_termination = true
  }
}

build {
  name    = "packer-ubuntu"
  sources = [
    "source.amazon-ebs.ubuntu_nodejs"
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
      "sudo chown -R csye6225:csye6225 /opt/csye6225/webapp",
      "sudo chmod -R 750 /opt/csye6225/webapp",
      "sudo npm install --prefix /opt/csye6225/webapp",
      "sudo mv /opt/csye6225/webapp/service/webapp.service /etc/systemd/system/webapp.service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable webapp.service"
    ]
  }
}
