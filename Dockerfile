FROM node:23.9.0

# Install git and recommended tools
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/AstroX11/Xstro/XstroSession /root \
    && cd /root \
    && yarn install \
    && npx tsc

WORKDIR /root

CMD ["npm", "start"]