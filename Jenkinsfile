pipeline {
    agent any

    stages {
        stage('Install APT dependencies') {
            steps {
                echo 'Installing apt packages...'
                sh 'sudo apt install -y python3-pip python3-venv'
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
                sh 'cd python'
                sh 'python3 -m venv env'
                sh 'source ./env/bin/activate'
                sh 'pip3 install -r requirements.txt'
            }
        }
        stage('Compile python executable') {
            steps {
                sh './compile.sh'
                sh 'cd ..'
                sh 'deactivate'
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