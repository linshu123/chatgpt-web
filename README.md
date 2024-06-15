# ChatGPT Proxy Server Notes

被墙：

[https://itlanyan.com/v2ray-traffic-mask/](https://itlanyan.com/v2ray-traffic-mask/)

[https://itlanyan.com/trojan-tutorial/](https://itlanyan.com/trojan-tutorial/)

Proxy choices: [https://squeezegrowth.com/zh-CN/best-proxy-server-services/](https://squeezegrowth.com/zh-CN/best-proxy-server-services/)

[https://www.youtube.com/results?search_query=Vultr+tutorial](https://www.youtube.com/results?search_query=Vultr+tutorial)

[https://www.freedidi.com/8910.html?url=https://github.com/Chanzhaoyu/chatgpt-web](https://www.freedidi.com/8910.html?url=https://github.com/Chanzhaoyu/chatgpt-web)

## Install Fish

`sudo apt install fish -y`

## Get Containers/images

```jsx
docker ps -a
docker container list
docker image list
docker rm <container id>

```

## Get Logs

```jsx
docker logs -f <container id>

# Export logs
docker logs <container id> > gpt-logs.txt
scp root@45.76.66.197:/root/projects/chatgpt-web/gpt-logs.txt /Users/linshu/Desktop/

```

## Change Port

- Change line:

```jsx
app.listen(3010, () => globalThis.console.log('Server is running on port 3002'))
```

- Change run command:

```jsx
docker run -p 3010:3010 --env OPENAI_API_KEY=<API_KEY> --name chatgpt-web-test -t linshu123/chatgpt-web-test:buildx-latest
```

## Build multi-architecture & deploy

doc: [https://www.docker.com/blog/how-to-rapidly-build-multi-architecture-images-with-buildx/](https://www.docker.com/blog/how-to-rapidly-build-multi-architecture-images-with-buildx/)

- Prepare:

```jsx
docker buildx create --name multiarch-builder
docker buildx use multiarch-builder
```

- Push:

```jsx
docker buildx build --push \
  --platform linux/amd64,linux/arm64 \
  --tag linshu123/chatgpt-web-test:buildx-latest .
```

- Run:

```jsx
docker run -p 3010:3010 --env OPENAI_API_KEY=<API_KEY> \
  --name chatgpt-web-test -t linshu123/chatgpt-web-test:buildx-latest
```

## Build & test flow

- [Local] Laptop dev

```jsx
# Run & test frontend
pnpm dev

# Run & test backend
VS Code: Launch service server
```

- [Local] Laptop test

```jsx
# Update port, change line
app.listen(3010, () => globalThis.console.log('Server is running on port 3002'))

# Build & run on 3010
docker build -t linshu123/chatgpt-web-test .
docker run -d -p 3010:3010 --env OPENAI_API_KEY=<API_KEY> \
  --name chatgpt-web-test -t linshu123/chatgpt-web-test

# Build & run on 3002
docker build -t linshu123/chatgpt-web-test .
docker run -d -p 3002:3002 --env OPENAI_API_KEY=<API_KEY> \
  --name chatgpt-web-test -t linshu123/chatgpt-web-test

# Go to http://localhost:3010/
```

- [Local] Build for remote test

```jsx
docker buildx build --push \
  --platform linux/amd64,linux/arm64 \
  --tag linshu123/chatgpt-web-test:buildx-latest .
```

- [Remote] Verify on remote

```jsx
# Run new image on port 3010
docker run -p 3010:3010 --env OPENAI_API_KEY=<API_KEY> \
  --name chatgpt-web-test -t linshu123/chatgpt-web-test:buildx-latest

# Go to http://45.76.66.197:3010/
```

- [Local] Build for deployment

```jsx
# Revert port changes on local
app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))

# Build & Push
docker buildx use multiarch-builder
docker buildx build --push \
  --platform linux/amd64,linux/arm64 \
  --tag linshu123/chatgpt-web-test:buildx-latest .
```

- [Remote] Deploy on remote

```jsx
docker container ls
docker container rm -f <container id>
docker image rm linshu123/chatgpt-web-test:buildx-latest
docker run \
       --name chatgpt-web-test \
       -p 3002:3002 \
       --env OPENAI_API_KEY=<API_KEY> \
       --restart always \
       -d linshu123/chatgpt-web-test:buildx-latest
```
