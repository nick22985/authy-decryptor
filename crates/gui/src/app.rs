use std::path::PathBuf;

use authy_decryptor_core::decrypt::{decrypt_csv_text, decrypt_json_text};

const SCHEMAS: &[&str] = &["authy", "aegis", "ente", "vaultwarden"];

#[derive(Default)]
pub struct AppState {
    pub input_path: Option<PathBuf>,
    pub schema: String,
    pub password: String,
    output: String,
    status: Status,
}

#[derive(Default, Clone)]
enum Status {
    #[default]
    Idle,
    Ok(String),
    Err(String),
}

pub fn run(mut initial: AppState) -> Result<(), eframe::Error> {
    if initial.schema.is_empty() {
        initial.schema = "authy".to_string();
    }
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([560.0, 520.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Authy Decryptor",
        options,
        Box::new(|_cc| Ok(Box::new(initial))),
    )
}

impl AppState {
    pub fn new(input_path: Option<PathBuf>, schema: String, password: String) -> Self {
        Self {
            input_path,
            schema: if schema.is_empty() {
                "authy".to_string()
            } else {
                schema
            },
            password,
            ..Default::default()
        }
    }

    fn decrypt(&mut self) {
        let Some(path) = self.input_path.clone() else {
            self.status = Status::Err("Select an input file first.".into());
            return;
        };
        let raw = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                self.status = Status::Err(format!("Failed to read file: {e}"));
                return;
            }
        };
        let name = path.to_string_lossy();
        let result = if name.ends_with(".csv") {
            decrypt_csv_text(&raw, &self.password, &self.schema)
        } else if name.ends_with(".json") {
            decrypt_json_text(&raw, &self.password, &self.schema)
        } else {
            Err("Unsupported input file type. Please use a .csv or .json file.".into())
        };
        match result {
            Ok(out) => {
                self.status = Status::Ok(format!("Decrypted with {} schema.", self.schema));
                self.output = out;
            }
            Err(e) => {
                self.status = Status::Err(e);
                self.output.clear();
            }
        }
    }

    fn save_output(&mut self) {
        let default_name = match self.schema.as_str() {
            "ente" => "authy-export.txt",
            _ => "authy-export.json",
        };
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name(default_name)
            .save_file()
        {
            match std::fs::write(&path, &self.output) {
                Ok(()) => {
                    self.status = Status::Ok(format!("Saved to {}", path.display()));
                }
                Err(e) => self.status = Status::Err(format!("Failed to save: {e}")),
            }
        }
    }
}

impl eframe::App for AppState {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Authy Decryptor");
            ui.label("Decrypt an Authy backup (.csv or encrypted .json) into a chosen format.");
            ui.add_space(8.0);

            ui.horizontal(|ui| {
                if ui.button("Select input file…").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("Authy backup", &["csv", "json"])
                        .add_filter("All files", &["*"])
                        .pick_file()
                    {
                        self.input_path = Some(path);
                    }
                }
                match &self.input_path {
                    Some(p) => ui.monospace(p.to_string_lossy()),
                    None => ui.weak("no file selected"),
                };
            });
            ui.add_space(6.0);

            ui.horizontal(|ui| {
                ui.label("Backup password:");
                ui.add(
                    egui::TextEdit::singleline(&mut self.password)
                        .password(true)
                        .desired_width(240.0),
                );
            });
            ui.add_space(6.0);

            ui.horizontal(|ui| {
                ui.label("Output schema:");
                egui::ComboBox::from_id_salt("schema")
                    .selected_text(&self.schema)
                    .show_ui(ui, |ui| {
                        for &s in SCHEMAS {
                            ui.selectable_value(&mut self.schema, s.to_string(), s);
                        }
                    });
            });
            ui.add_space(10.0);

            ui.horizontal(|ui| {
                let can_decrypt = self.input_path.is_some() && !self.password.is_empty();
                if ui
                    .add_enabled(can_decrypt, egui::Button::new("Decrypt"))
                    .clicked()
                {
                    self.decrypt();
                }
                if ui
                    .add_enabled(!self.output.is_empty(), egui::Button::new("Save output…"))
                    .clicked()
                {
                    self.save_output();
                }
            });
            ui.add_space(8.0);

            match &self.status {
                Status::Idle => {}
                Status::Ok(msg) => {
                    ui.colored_label(egui::Color32::from_rgb(60, 160, 60), format!("✅ {msg}"));
                }
                Status::Err(msg) => {
                    ui.colored_label(egui::Color32::from_rgb(200, 70, 70), format!("❌ {msg}"));
                }
            }

            if !self.output.is_empty() {
                ui.add_space(8.0);
                ui.separator();
                ui.label("Preview:");
                egui::ScrollArea::vertical().show(ui, |ui| {
                    ui.add(
                        egui::TextEdit::multiline(&mut self.output.as_str())
                            .font(egui::TextStyle::Monospace)
                            .desired_width(f32::INFINITY)
                            .desired_rows(14),
                    );
                });
            }
        });
    }
}
