## Build

```shell
docker build -t brunorossetto/sottelli-flosum-pmd:latest -t brunorossetto/sottelli-flosum-pmd:6.55.0 .
```

## Push to DockerHub

```shell
docker push brunorossetto/sottelli-flosum-pmd --all-tags
```

## Run

```shell
docker run --rm brunorossetto/sottelli-flosum-pmd:latest
```
