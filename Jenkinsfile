pipeline {
    agent {
        docker {
            image 'node:lts'
            args '-u root:root'
        }
    }

    stages {
        stage('Install apt dependencies') {
            steps {
                echo 'Installing apt packages...'
                sh 'apt-get update && apt install -y python3-pip python3-venv rpm git dirmngr gnupg apt-transport-https ca-certificates'
                sh 'apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 3FA7E0328081BFF6A14DA29AA6A19B38D3D831EF'
                sh 'echo "deb https://download.mono-project.com/repo/debian stable-bookworm main" > /etc/apt/sources.list.d/mono-official-stable.list'
            }
        }
        stage('Install mono') {
            steps {
                sh 'apt update && apt install -y mono-complete'
            }
        }
        stage('Install wine') {
            steps {
                sh 'apt install -y wine'
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
                sh 'cd python && python3 -m venv --copies env'
                sh 'cd python && . env/bin/activate && pip3 install -r requirements.txt && deactivate'
            }
        }
        stage('Compile python executable') {
            steps {
                sh 'cd python && . env/bin/activate && ./compile.sh && deactivate'
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