Lien du dépôt : https://github.com/alexy103/cours-websocket-cc1

### Lancement

```bash
docker compose up --build -d
```

Le projet est accessible sur http://localhost:3000, ou selon le PORT indiqué dans le .env (si modifié).

- `/` : liste des commandes
- `/suivi.html?id=<id>` : suivi en direct d'une commande

### API

| Méthode | Route                         | Description                          |
| ------- | ----------------------------- | ------------------------------------ |
| GET     | `/api/users`                  | Liste les utilisateurs               |
| GET     | `/api/products`               | Liste les produits et leur stock     |
| GET     | `/api/orders`                 | Liste les commandes                  |
| GET     | `/api/orders/:id`             | Liste une commande                   |
| POST    | `/api/orders`                 | Crée une commande                    |
| POST    | `/api/orders/:id/next-status` | Passe une commande au statut suivant |
| POST    | `/api/orders/:id/cancel`      | Annule une commande                  |

### Temps réel (SSE)

| Route                        | Contenu                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| `GET /api/orders/stream`     | Tous les événements                                                      |
| `GET /api/orders/:id/stream` | Uniquement les événements de la commande `:id` (tri fait par le serveur) |

| Événement              | Quand                                     |
| ---------------------- | ----------------------------------------- |
| `order-created`        | création d'une commande                   |
| `order-status-updated` | changement de statut d'une commande       |
| `order-cancelled`      | annulation d'une commande                 |
| `stock-updated`        | modification à jour du stock d'un produit |

## Exigences et bonus

Toutes les exigences de F1 à F10 ont été effecutées, aucun bonus n'a été fait.
