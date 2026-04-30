# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Run the production server (api/index.js)
- `npm run dev` - Run development server with nodemon auto-reload

## Architecture Overview

This is a Korean boardgame recommendation web application with the following architecture:

### Backend (Node.js/Express)
- **Main server**: `api/index.js` - Express server with EJS templating
- **Database**: Supabase (PostgreSQL) as primary database
- **Supabase client**: `supabase-client.js` - Database connection configuration

### Frontend
- **Template engine**: EJS (`views/index.ejs`, `views/mypage.ejs`)
- **Styling**: Shared stylesheet in `public/css/styles.css`
- **JavaScript**: Vanilla JS in `public/js/` for interactivity (users, toggles, ratings, modals)

### Data Sources
- **BGG API**: Crawls BoardGameGeek.com for game data using XML API
- **Sync scripts**: Node scripts in `scripts/` load BGG dump/detail data into Supabase
- **Database tables**: 
  - `boardgames` - Game metadata (name, rating, weight, players, etc.)
  - `user_data` - Per-user favorites, wishlist, owned/planned state, and personal ratings
  - `reviews` - User ratings and reviews

### Key Features
- **Search & Filter**: By game name, player count, weight (complexity), favorites
- **Player Range Search**: Complex range parsing (e.g., "2-4", "3|5") handled in JavaScript
- **Performance Optimizations**:
  - In-memory caching with TTL (5 min cache, 10 min cleanup)
  - Selective column loading
  - N+1 query prevention for reviews
  - Environment-based constants

### Database Schema
- Games have Korean names (`korean_name`) and display logic prioritizes Korean over English
- User data includes favorites (`is_favorite`) and personal ratings
- BGG ID used as primary identifier across tables

### Deployment
- **Platform**: Vercel serverless functions
- **Configuration**: `vercel.json` routes all requests to `api/index.js`
- **Region**: Korea (`icn1`)
- **Timeout**: 30 seconds max duration
