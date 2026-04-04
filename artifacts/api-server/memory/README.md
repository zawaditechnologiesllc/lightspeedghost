# Memory Layer

This directory contains the persistent memory architecture for LightSpeed Ghost.

## Structure

- **student_profile**: Stored in PostgreSQL `student_profiles` table
  - Strengths, struggles, recent topics, preferred subjects
  - Session count and notes
  - Updated after every study session

## Memory Flush
Before session compaction, important facts are written to `notes` column.
This prevents "context amnesia" over long-running student sessions.

## Two-Layer Architecture (OpenClaw-Inspired)
- **Layer 1 (Short-term)**: Full conversation context in current API request
- **Layer 2 (Long-term)**: `student_profiles` DB table — persists across sessions

## Future: Redis + Vector DB
For "Jarvis-style" 92% retrieval accuracy:
- Redis: Short-term session cache
- Qdrant/Pinecone: Vector embeddings for semantic memory retrieval
