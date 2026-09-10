pub mod employee;
pub mod enums;
pub mod settings;
pub mod startup;

pub use employee::*;
pub use enums::*;
pub use settings::*;
pub use startup::*;

#[cfg(test)]
mod export_bindings {
    #[test]
    fn export_bindings() {
        // #[ts(export)] writes files when cargo test runs.
    }
}
