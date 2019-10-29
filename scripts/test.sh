#!/usr/bin/env bash

node_modules/.bin/ganache-cli > test/ganache.log &
ganache_pid=$!

node_modules/.bin/truffle test

kill -9 $ganache_pid
