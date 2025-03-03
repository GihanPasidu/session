FROM node:23.9.0

RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g typescript@latest

RUN git clone https://github.com/AstroX11/XstroSession /xstro
WORKDIR /xstro
RUN npm install && npx tsc
CMD ["npm", "start"]