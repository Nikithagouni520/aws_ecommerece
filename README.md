# Northstar Goods - Scalable E-commerce Website on AWS

Northstar Goods is a full-stack e-commerce web application built with a vanilla HTML/CSS/JavaScript storefront, a Node.js/Express backend, and Amazon RDS MySQL-compatible persistence. The project is designed for deployment on AWS using EC2, Application Load Balancer, Auto Scaling Group, Amazon RDS, and CloudFront.

This project was prepared for the internship cloud project requirement:

> Scalable E-commerce Website on Cloud  
> Objective: Deploy a full-stack e-commerce website with auto-scaling.

## Project Objective

The objective of this project is to deploy a scalable e-commerce website on AWS with:

- Backend hosted on EC2
- Application Load Balancer for traffic distribution
- Auto Scaling Group for scalability and availability
- Amazon RDS MySQL database for persistent storage
- CloudFront CDN for improved performance
- Secure networking using Security Groups

## Features

- Product catalog loaded from Amazon RDS
- Seeded fallback product data for local/demo mode
- Search and category filtering
- Shopping cart drawer
- Checkout flow
- Order persistence in MySQL
- Order item persistence using relational tables
- Newsletter subscriber storage
- Health-check endpoint for AWS load balancer
- Static frontend served by the Express backend

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | Amazon RDS MySQL |
| Cloud Compute | Amazon EC2 |
| Load Balancing | Application Load Balancer |
| Scaling | Auto Scaling Group |
| CDN | Amazon CloudFront |
| Secrets | AWS Secrets Manager |
| Process Manager | systemd |

## AWS Architecture

```text
Users
  |
  v
Amazon CloudFront
  |
  v
Application Load Balancer
  |
  v
EC2 Auto Scaling Group
  |
  v
Amazon RDS MySQL
```

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
  package-lock.json

README.md
```

## Database Design

The application uses Amazon RDS MySQL instead of MongoDB.

### Tables

- `products`
- `orders`
- `order_items`
- `newsletter_subscribers`

The backend automatically creates the required tables when a valid RDS connection is available.

## MongoDB to RDS Conversion

| Previous MERN/MongoDB Concept | Current MySQL/RDS Implementation |
|---|---|
| Product document | `products` table |
| Order document | `orders` table |
| Embedded order items | `order_items` table |
| Newsletter document | `newsletter_subscribers` table |
| Mongoose queries | Parameterized `mysql2` SQL queries |
| MongoDB connection string | RDS endpoint and MySQL credentials |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api` | API status |
| GET | `/api/health` | Health check for AWS load balancer |
| GET | `/api/products` | Fetch product catalog |
| POST | `/api/orders` | Place an order |
| POST | `/api/newsletter` | Subscribe to newsletter |

Health check response:

```json
{
  "ok": true,
  "database": "connected"
}
```

## Run Locally

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Create environment file

Copy the sample environment file:

```bash
copy .env.example .env
```

For Linux/macOS:

```bash
cp .env.example .env
```

### 3. Start development server

```bash
npm run dev
```

Open:

```text
http://localhost:5000
```

If database variables are not configured, the app runs in demo mode with in-memory product data.

## Environment Variables

Create `server/.env` using the following format:

```env
PORT=5000
CLIENT_URL=http://localhost:5000
DB_HOST=your-rds-endpoint.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=ecommerce
DB_SSL=false
DB_CONNECTION_LIMIT=10
```

Do not commit `.env` to GitHub.

## AWS Deployment Steps

### 1. Create Amazon RDS MySQL Database

Create an Amazon RDS MySQL database with:

- Engine: MySQL
- Database name: `ecommerce`
- Public access: No
- Port: `3306`
- Security group allowing MySQL access only from EC2

### 2. Create Security Groups

#### Load Balancer Security Group

Inbound:

```text
HTTP 80 from 0.0.0.0/0
HTTPS 443 from 0.0.0.0/0
```

#### EC2 Security Group

Inbound:

```text
Custom TCP 5000 from Load Balancer Security Group
```

#### RDS Security Group

Inbound:

```text
MySQL 3306 from EC2 Security Group
```

### 3. Store Environment Variables in AWS Secrets Manager

Secret name:

```text
northstar/prod/env
```

Secret value:

```json
{
  "PORT": "5000",
  "DB_HOST": "your-rds-endpoint.us-east-1.rds.amazonaws.com",
  "DB_PORT": "3306",
  "DB_USER": "admin",
  "DB_PASSWORD": "your-password",
  "DB_NAME": "ecommerce",
  "DB_SSL": "false",
  "DB_CONNECTION_LIMIT": "10"
}
```

### 4. Create IAM Role for EC2

Create an IAM role named:

```text
northstar-ec2-role
```

Attach:

- `AmazonSSMManagedInstanceCore`
- Inline permission to read the secret from Secrets Manager

Example inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:northstar/prod/env-*"
    }
  ]
}
```

### 5. Create Target Group

Target group settings:

```text
Target type: Instances
Protocol: HTTP
Port: 5000
Health check path: /api/health
Success code: 200
```

### 6. Create Application Load Balancer

Create an internet-facing Application Load Balancer:

```text
Listener: HTTP 80
Forward to: northstar-tg
```

### 7. Create Launch Template

Use Amazon Linux 2023 and attach the EC2 IAM role.

Example user-data script:

```bash
#!/bin/bash
set -e

REGION="us-east-1"
SECRET_NAME="northstar/prod/env"
REPOSITORY="https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git"

dnf update -y
dnf install -y git jq

curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

rm -rf /opt/northstar
git clone --depth 1 "$REPOSITORY" /opt/northstar

cd /opt/northstar/server
npm ci --omit=dev

aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query SecretString \
  --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /opt/northstar/server/.env

chmod 600 /opt/northstar/server/.env

cat > /etc/systemd/system/northstar.service <<'EOF'
[Unit]
Description=Northstar Ecommerce Application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/northstar/server
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable northstar
systemctl start northstar
```

### 8. Create Auto Scaling Group

Recommended settings:

```text
Desired capacity: 2
Minimum capacity: 1
Maximum capacity: 4
Health checks: ELB health checks enabled
Health check grace period: 300 seconds
```

Scaling policy:

```text
Metric: Average CPU utilization
Target value: 50%
```

### 9. Add CloudFront

Create a CloudFront distribution with the Application Load Balancer as the origin.

Default behavior:

```text
Allowed methods: GET, HEAD, OPTIONS
Viewer protocol policy: Redirect HTTP to HTTPS
Cache policy: CachingOptimized
```

API behavior:

```text
Path pattern: /api/*
Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
Cache policy: CachingDisabled
Origin request policy: AllViewerExceptHostHeader
```

## Deployment Verification

### Local EC2 test

Run inside EC2:

```bash
curl -i http://localhost:5000/api/health
```

Expected:

```json
{
  "ok": true,
  "database": "connected"
}
```

### Load Balancer test

Open:

```text
http://YOUR-ALB-DNS/api/health
```

### CloudFront test

Open:

```text
https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net
```

## Troubleshooting Notes

### Target group is unhealthy

Check:

- EC2 app is running on port `5000`
- Target group protocol is HTTP and port is `5000`
- Health path is `/api/health`
- EC2 security group allows port `5000` from the ALB security group
- Auto Scaling Group has an `InService` instance

### App says `Server running on port null`

Fix the Secrets Manager value. `PORT` must be:

```json
"PORT": "5000"
```

### Secret values become null in `.env`

Use this safer user-data command:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query SecretString \
  --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /opt/northstar/server/.env
```

### Database connection failed

Check:

- RDS endpoint is correct
- RDS database name is correct
- RDS security group allows MySQL from EC2 security group
- `DB_USER` and `DB_PASSWORD` are correct

## Screenshots to Add

Add screenshots of:

- Running website
- RDS database
- Application Load Balancer
- Healthy target group
- Auto Scaling Group
- CloudFront distribution
- Health endpoint response

Suggested folder:

```text
docs/screenshots/
```

## Future Improvements

- Add user authentication
- Add payment gateway integration
- Add admin dashboard
- Add CI/CD with GitHub Actions
- Add HTTPS certificate with AWS Certificate Manager
- Add monitoring using CloudWatch dashboards
- Add WAF protection for CloudFront

## Author

Nikita

## Project Status

This project includes the complete application code and AWS deployment documentation for a scalable cloud-based e-commerce architecture. Update this section with your final live CloudFront URL after deployment verification.

```text
Live URL: Add your CloudFront or ALB URL here
GitHub Repository: Add your GitHub repository URL here
```
