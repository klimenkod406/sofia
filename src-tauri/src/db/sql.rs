//! Minimal `Sql` / `Value` layer over `sqlx::SqlitePool`.
//!
//! The repositories in this project were written against a small API
//! (`execute_with_params`, `select_with_params`, …) with rows represented
//! as `serde_json::Value`. This module implements exactly that API on top
//! of `sqlx`, so the repository code can stay as-is.

use anyhow::Result;
use serde_json::{json, Value as JsonValue};
use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Row, SqlitePool, TypeInfo};

/// Query parameter value.
#[derive(Debug, Clone)]
pub enum Value {
    Null,
    Integer(i64),
    Real(f64),
    Text(String),
}

impl From<String> for Value {
    fn from(v: String) -> Self {
        Value::Text(v)
    }
}

impl From<&str> for Value {
    fn from(v: &str) -> Self {
        Value::Text(v.to_string())
    }
}

impl From<i64> for Value {
    fn from(v: i64) -> Self {
        Value::Integer(v)
    }
}

impl From<i32> for Value {
    fn from(v: i32) -> Self {
        Value::Integer(v as i64)
    }
}

impl From<f64> for Value {
    fn from(v: f64) -> Self {
        Value::Real(v)
    }
}

impl From<bool> for Value {
    fn from(v: bool) -> Self {
        Value::Integer(if v { 1 } else { 0 })
    }
}

/// Thin wrapper around a SQLite connection pool.
#[derive(Debug, Clone)]
pub struct Sql {
    pool: SqlitePool,
}

impl Sql {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn execute(&self, query: &str) -> Result<u64> {
        let res = sqlx::query(query).execute(&self.pool).await?;
        Ok(res.rows_affected())
    }

    pub async fn execute_with_params(&self, query: &str, params: Vec<Value>) -> Result<u64> {
        let mut q = sqlx::query(query);
        for p in params {
            q = bind_value(q, p);
        }
        let res = q.execute(&self.pool).await?;
        Ok(res.rows_affected())
    }

    pub async fn select(&self, query: &str) -> Result<Vec<JsonValue>> {
        let rows = sqlx::query(query).fetch_all(&self.pool).await?;
        Ok(rows.into_iter().map(row_to_json).collect())
    }

    pub async fn select_with_params(
        &self,
        query: &str,
        params: Vec<Value>,
    ) -> Result<Vec<JsonValue>> {
        let mut q = sqlx::query(query);
        for p in params {
            q = bind_value(q, p);
        }
        let rows = q.fetch_all(&self.pool).await?;
        Ok(rows.into_iter().map(row_to_json).collect())
    }

    pub async fn select_one(&self, query: &str) -> Result<Option<JsonValue>> {
        let rows = self.select(query).await?;
        Ok(rows.into_iter().next())
    }

    pub async fn select_one_with_params(
        &self,
        query: &str,
        params: Vec<Value>,
    ) -> Result<Option<JsonValue>> {
        let rows = self.select_with_params(query, params).await?;
        Ok(rows.into_iter().next())
    }
}

fn bind_value<'q>(
    q: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    v: Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    match v {
        Value::Null => q.bind(Option::<String>::None),
        Value::Integer(i) => q.bind(i),
        Value::Real(f) => q.bind(f),
        Value::Text(s) => q.bind(s),
    }
}

fn row_to_json(row: SqliteRow) -> JsonValue {
    let mut map = serde_json::Map::with_capacity(row.len());
    for (i, col) in row.columns().iter().enumerate() {
        map.insert(col.name().to_string(), column_to_json(&row, i));
    }
    JsonValue::Object(map)
}

fn column_to_json(row: &SqliteRow, idx: usize) -> JsonValue {
    let type_name = row
        .columns()
        .get(idx)
        .map(|c| c.type_info().name().to_string())
        .unwrap_or_default();
    let t = type_name.to_ascii_uppercase();

    // NULL check first: decoding as Option<String> yields Ok(None) for NULL
    // regardless of the declared type.
    let is_null: bool = row
        .try_get::<Option<Vec<u8>>, _>(idx)
        .map(|v| v.is_none())
        .unwrap_or(false);
    if is_null {
        return JsonValue::Null;
    }

    if t.contains("INT") {
        if let Ok(v) = row.try_get::<i64, _>(idx) {
            return json!(v);
        }
    } else if t.contains("CHAR")
        || t.contains("CLOB")
        || t.contains("TEXT")
        || t.contains("DATE")
        || t.contains("TIME")
    {
        if let Ok(v) = row.try_get::<String, _>(idx) {
            return json!(v);
        }
    } else if t.contains("REAL") || t.contains("FLOA") || t.contains("DOUB") {
        if let Ok(v) = row.try_get::<f64, _>(idx) {
            return json!(v);
        }
    } else if t.contains("BLOB") {
        return JsonValue::Null;
    }

    // Fallback: try string, then integer, then float (covers NUMERIC,
    // BOOLEAN and any other affinity).
    if let Ok(v) = row.try_get::<String, _>(idx) {
        // Guard against SQLite returning integers as strings: prefer the
        // numeric decoding when the declared type is numeric-ish.
        if t.contains("NUMERIC") || t.contains("BOOL") || t.contains("DECIMAL") {
            if let Ok(n) = row.try_get::<i64, _>(idx) {
                return json!(n);
            }
        }
        return json!(v);
    }
    if let Ok(n) = row.try_get::<i64, _>(idx) {
        return json!(n);
    }
    if let Ok(f) = row.try_get::<f64, _>(idx) {
        return json!(f);
    }
    JsonValue::Null
}
