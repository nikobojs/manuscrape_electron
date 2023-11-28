pipeline {
    agent any

    stages {
        stage('Install APT dependencies') {
            steps {
                echo 'Installing apt packages...'
                sh 'sudo apt install -y python3-pip python3-venv rpm'
            }
        }
        stage('Install NPM dependencies') {
            steps {
                echo 'Removing all node_modules data..'
                sh 'rm -rf node_modules'
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