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

variable "ami_users" {
  type        = list(string)
  description = "List of AWS account IDs that can access the AMI"
  default     = []
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
    volume_type           = "gp3"
    delete_on_termination = true
  }
}

build {
  name = "packer-ubuntu"
  sources = [
    "source.amazon-ebs.ubuntu_nodejs",
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
      "sudo apt install -y unzip",
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
