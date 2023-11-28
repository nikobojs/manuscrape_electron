pipeline {
    agent {
        docker {
            image 'debian:12'
            args '-u root:root'
        }
    }

    stages {
        stage('Install apt dependencies') {
            steps {
                echo 'Installing apt packages...'
                sh 'apt-get update && apt-get install -y sudo'
                sh 'apt install -y python3-pip python3-venv rpm curl git'
            }
        }
        stage('Install nodejs/npm') {
            steps {
                echo 'Installing npm via. n'
                sh 'curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s lts'
            }
        }
        stage('Install NPM dependencies') {
            steps {
                echo 'Installing npm libs..'
                sh 'npm install'
            }
        }
        stage('Install PyPi dependencies') {
            steps {
                echo 'Creating and activating python virtual environment..'
                sh 'cd python && python3 -m venv env'
                sh 'cd python && source ./env/bin/activate && pip3 install -r requirements.txt && deactivate'
            }
        }
        stage('Compile python executable') {
            steps {
                sh 'cd python && source ./env/bin/activate && ./compile.sh && deactivate'
            }
        }
        stage('Compile binary installer') {
            steps {
                sh 'npm run make'
            }
        }
        stage('Deploy') {
            steps {
                echo 'Deploying....'
                echo 'WARN: not implemented yet'
            }
        }
    }
}