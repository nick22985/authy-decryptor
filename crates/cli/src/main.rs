use std::process::ExitCode;

use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "authy-decryptor", version, about)]
struct Cli {
    #[arg(short, long)]
    input: String,

    #[arg(short, long)]
    output: String,

    #[arg(long, default_value = "authy")]
    schema: String,

    #[arg(short, long)]
    password: Option<String>,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let cwd = std::env::current_dir().unwrap_or_default();
    let input_path = cwd.join(&cli.input);
    let output_path = cwd.join(&cli.output);

    match authy_decryptor_core::decrypt::run(
        &input_path,
        &output_path,
        &cli.schema,
        cli.password.as_deref(),
    ) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
