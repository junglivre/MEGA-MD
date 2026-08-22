FROM quay.io/qasimtech/mega-md:latest

WORKDIR /root/mega-md

RUN git clone https://github.com/junglivre/MEGA-MD . && \
    npm install

EXPOSE 5000

CMD ["npm", "start"]
