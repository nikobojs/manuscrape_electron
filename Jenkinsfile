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
                sh 'npm run pyinstall'
                sh 'npm run pyfreeze'
                sh 'npm run make'
            }
        }
        stage('Install PyPi dependencies') {
            steps {
                echo 'Installing pip3 libs..'
                sh 'cd python'
                sh 'source ./env/bin/activate'
                sh 'pip3 install -r requirements.txt'
            }
        }
        stage('Compile python executable') {
            steps {
                sh './compile.sh'
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