.PHONY: up down reset test e2e check carga
up:      ; docker compose up -d --build
down:    ; docker compose down
reset:   ; docker compose down -v && docker compose up -d --build
test:    ; npm test
e2e:     ; npm run test:e2e
check:   ; npm run check
carga:   ; npm run seed && npm run seed:load && k6 run tests/load/listados.k6.js
