## Build

```shell
docker build -t sottelli-flosum-pmd .
```

## Run

```shell
docker run --rm -p 5005:5000  -e username=sf -e password=sf  sottelli-flosum-pmd
```

## Create new Tag to Build in GitHub

```shell
git tag #.#.#
git push origin --tags
```
