#!/bin/bash
# start the dev server only for the duration of one scripted run
npx vite --port 5173 --strictPort > /tmp/claude-0/-home-user-kiddos-games/c580d51f-5250-53d1-ad19-3ed12caab66c/scratchpad/vite.log 2>&1 &
VPID=$!
until curl -s -o /dev/null http://127.0.0.1:5173/; do sleep 0.5; done
node "$@"
kill $VPID
