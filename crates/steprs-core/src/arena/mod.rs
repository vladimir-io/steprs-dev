use std::collections::HashMap;

use crate::core::DENSITY_THRESHOLD;
use crate::entity::StepEntity;
use crate::parser::prescan::PrescanResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageMode {
    Dense,
    Sparse,
}

enum Storage {
    Dense(Vec<Option<StepEntity>>),
    Sparse(HashMap<u32, StepEntity>),
}

pub struct Arena {
    mode: StorageMode,
    storage: Storage,
}

impl Default for Arena {
    fn default() -> Self {
        Self::new()
    }
}

impl Arena {
    pub fn new() -> Self {
        Self {
            mode: StorageMode::Sparse,
            storage: Storage::Sparse(HashMap::new()),
        }
    }

    pub fn from_prescan(prescan: &PrescanResult) -> Self {
        let mode = if prescan.density >= DENSITY_THRESHOLD {
            StorageMode::Dense
        } else {
            StorageMode::Sparse
        };

        let storage = match mode {
            StorageMode::Dense => {
                let slots = vec![None; (prescan.max_id as usize) + 1];
                Storage::Dense(slots)
            }
            StorageMode::Sparse => Storage::Sparse(HashMap::with_capacity(prescan.entity_count)),
        };

        Self { mode, storage }
    }

    pub fn mode(&self) -> StorageMode {
        self.mode
    }

    pub fn insert(&mut self, id: u32, entity: StepEntity) {
        match &mut self.storage {
            Storage::Dense(slots) => {
                let idx = id as usize;
                if idx >= slots.len() {
                    slots.resize(idx + 1, None);
                }
                slots[idx] = Some(entity);
            }
            Storage::Sparse(map) => {
                map.insert(id, entity);
            }
        }
    }

    pub fn get(&self, id: u32) -> Option<&StepEntity> {
        match &self.storage {
            Storage::Dense(slots) => slots.get(id as usize).and_then(|s| s.as_ref()),
            Storage::Sparse(map) => map.get(&id),
        }
    }

    pub fn get_mut(&mut self, id: u32) -> Option<&mut StepEntity> {
        match &mut self.storage {
            Storage::Dense(slots) => {
                let idx = id as usize;
                if idx >= slots.len() {
                    return None;
                }
                slots[idx].as_mut()
            }
            Storage::Sparse(map) => map.get_mut(&id),
        }
    }

    pub fn entity_count(&self) -> usize {
        match &self.storage {
            Storage::Dense(slots) => slots.iter().filter(|s| s.is_some()).count(),
            Storage::Sparse(map) => map.len(),
        }
    }

    pub fn max_id(&self) -> u32 {
        match &self.storage {
            Storage::Dense(slots) => slots.len().saturating_sub(1) as u32,
            Storage::Sparse(map) => map.keys().copied().max().unwrap_or(0),
        }
    }

    pub fn iter(&self) -> ArenaIter<'_> {
        match &self.storage {
            Storage::Dense(slots) => ArenaIter::Dense(slots.iter().enumerate()),
            Storage::Sparse(map) => ArenaIter::Sparse(map.iter()),
        }
    }
}

pub enum ArenaIter<'a> {
    Dense(std::iter::Enumerate<std::slice::Iter<'a, Option<StepEntity>>>),
    Sparse(std::collections::hash_map::Iter<'a, u32, StepEntity>),
}

impl<'a> Iterator for ArenaIter<'a> {
    type Item = (u32, &'a StepEntity);

    fn next(&mut self) -> Option<Self::Item> {
        match self {
            ArenaIter::Dense(iter) => loop {
                let (idx, entity) = iter.next()?;
                if let Some(e) = entity {
                    return Some((idx as u32, e));
                }
            },
            ArenaIter::Sparse(iter) => iter.next().map(|(id, entity)| (*id, entity)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::prescan::PrescanResult;

    #[test]
    fn dense_arena_o1_lookup() {
        let prescan = PrescanResult {
            entity_count: 5,
            max_id: 4,
            density: 1.0,
        };
        let mut arena = Arena::from_prescan(&prescan);
        arena.insert(
            2,
            StepEntity::CartesianPoint {
                x: 1.0,
                y: 2.0,
                z: 3.0,
            },
        );
        assert!(matches!(
            arena.get(2),
            Some(StepEntity::CartesianPoint { x, .. }) if *x == 1.0
        ));
    }

    #[test]
    fn sparse_arena_avoids_huge_vec() {
        let prescan = PrescanResult {
            entity_count: 2,
            max_id: 500_000,
            density: 2.0 / 500_001.0,
        };
        let arena = Arena::from_prescan(&prescan);
        assert_eq!(arena.mode(), StorageMode::Sparse);
    }
}
