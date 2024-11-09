#!/bin/bash

rm -f dist/index.js
tsc
node dist/index.js