//! Split parse output: metrics JSON + typed-array mesh (avoids serializing floats as JSON).

use js_sys::{Float32Array, Object, Reflect, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::output::{ParseResult, TessellatedMesh};

pub fn tessellated_mesh_to_js(mesh: &TessellatedMesh) -> Result<JsValue, JsValue> {
    let obj = Object::new();
    Reflect::set(
        &obj,
        &JsValue::from_str("positions"),
        &Float32Array::from(mesh.positions.as_slice()),
    )?;
    Reflect::set(
        &obj,
        &JsValue::from_str("normals"),
        &Float32Array::from(mesh.normals.as_slice()),
    )?;
    Reflect::set(
        &obj,
        &JsValue::from_str("indices"),
        &Uint32Array::from(mesh.indices.as_slice()),
    )?;
    Reflect::set(
        &obj,
        &JsValue::from_str("triangle_count"),
        &JsValue::from_f64(mesh.triangle_count as f64),
    )?;
    Reflect::set(
        &obj,
        &JsValue::from_str("truncated"),
        &JsValue::from_bool(mesh.truncated),
    )?;
    Reflect::set(
        &obj,
        &JsValue::from_str("mesh_engine"),
        &JsValue::from_str(&mesh.mesh_engine),
    )?;

    let fr_json =
        serde_json::to_string(&mesh.face_ranges).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Reflect::set(
        &obj,
        &JsValue::from_str("face_ranges"),
        &js_sys::JSON::parse(&fr_json)?,
    )?;

    if !mesh.edge_positions.is_empty() {
        Reflect::set(
            &obj,
            &JsValue::from_str("edge_positions"),
            &Float32Array::from(mesh.edge_positions.as_slice()),
        )?;
        Reflect::set(
            &obj,
            &JsValue::from_str("edge_segment_count"),
            &JsValue::from_f64(mesh.edge_segment_count as f64),
        )?;
    }

    Ok(obj.into())
}

pub fn parse_result_wire(mut result: ParseResult) -> Result<JsValue, JsValue> {
    let mesh = result.mesh.take();
    let metrics_json =
        serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let metrics = js_sys::JSON::parse(&metrics_json)?;

    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str("metrics"), &metrics)?;
    if let Some(m) = mesh {
        Reflect::set(
            &obj,
            &JsValue::from_str("mesh"),
            &tessellated_mesh_to_js(&m)?,
        )?;
    }
    Ok(obj.into())
}
