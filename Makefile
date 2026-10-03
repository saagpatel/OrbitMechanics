.PHONY: dev build test clean install

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

test:
	npm test

clean:
	rm -rf node_modules dist .next .turbo
