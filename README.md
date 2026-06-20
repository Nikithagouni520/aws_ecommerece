# Northstar Goods Ecommerce

A full-stack ecommerce starter built with a vanilla HTML/CSS/JavaScript storefront, an Express API, and AWS RDS MySQL-compatible persistence.

## Features

- Product catalog from RDS, with seeded fallback data
- Search, category filters, cart drawer, and checkout flow
- Order and order item persistence
- Newsletter subscriber persistence
- Static frontend served by the Express server
- Health endpoint for AWS load balancers: `GET /api/health`

## Project Structure

```text
client/
  index.html
  app.js
  styles.css
server/
  server.js
  schema.sql
  .env.example
  package.json
```

## Run Locally

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5000`.

The app runs without database variables by using in-memory demo data. Add the RDS variables in `server/.env` when your database is ready.

## AWS RDS Setup

1. Create an RDS MySQL database in AWS.
2. Create a database named `ecommerce`.
3. Allow inbound MySQL traffic on port `3306` from your app host security group.
4. Add the RDS endpoint, username, password, and database name to environment variables.
5. Start the server. It automatically creates the required tables and seeds products if the `products` table is empty.

Required environment variables:

```bash
PORT=5000
CLIENT_URL=https://your-domain.com
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=ecommerce
DB_SSL=false
```

## AWS Hosting Option

A simple production path is:

1. Deploy the Node/Express app to Elastic Beanstalk, ECS/Fargate, or an EC2 instance.
2. Put the app and RDS database in the same VPC.
3. Use Security Groups so only the app can reach RDS.
4. Set the environment variables on the hosting service.
5. Point Route 53 or your domain DNS at the app load balancer.

For production checkout, connect a payment provider such as Stripe and store only payment provider references, not card details.
