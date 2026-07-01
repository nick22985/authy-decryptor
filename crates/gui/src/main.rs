#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;

mod app;

#[derive(Parser, Debug)]
#[command(name = "authy-decryptor-gui", version, about)]
struct Cli {
    #[arg(short, long)]
    input: Option<String>,

    #[arg(short, long)]
    output: Option<String>,

    #[arg(long, default_value = "authy")]
    schema: String,

    #[arg(short, long)]
    password: Option<String>,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    if let (Some(input), Some(output)) = (&cli.input, &cli.output) {
        let cwd = std::env::current_dir().unwrap_or_default();
        return match authy_decryptor_core::decrypt::run(
            &cwd.join(input),
            &cwd.join(output),
            &cli.schema,
            cli.password.as_deref(),
        ) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                eprintln!("{e}");
                ExitCode::FAILURE
            }
        };
    }

    let initial = app::AppState::new(
        cli.input.map(PathBuf::from),
        cli.schema,
        cli.password.unwrap_or_default(),
    );

    match app::run(initial) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("Failed to start GUI: {e}");
            ExitCode::FAILURE
        }
    }
}
