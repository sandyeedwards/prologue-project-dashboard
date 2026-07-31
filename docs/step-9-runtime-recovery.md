# Step 9 v1.0.1 runtime recovery

Step 9 v1.0.0 assumed PostgreSQL timestamp columns were always returned as JavaScript `Date` objects. In the Windows development runtime, the reporting query returned serialized timestamp strings. The dashboard then called `getTime()` directly and failed.

Version 1.0.1 normalizes timestamps at the reporting data boundary and includes regression tests. No database migration or Teamwork synchronization is required.
