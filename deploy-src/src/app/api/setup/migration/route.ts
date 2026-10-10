import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * GET /api/setup/migration
 * Serves the SQL migration file as downloadable plain text.
 * This allows users to easily access the migration SQL
 * without needing to open .sql files in the IDE (which shows "unsupported file format").
 */
export async function GET() {
  try {
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql')
    const sqlContent = await readFile(sqlPath, 'utf-8')

    return new NextResponse(sqlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="001_initial_schema.sql"',
        'Cache-Control': 'no-cache',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Migration file not found. The SQL is also available in the Supabase Setup Wizard within the app.' },
      { status: 404 }
    )
  }
}
