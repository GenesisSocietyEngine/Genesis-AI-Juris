fn main() {
    match juris_scenario_simulator::run_cli(std::env::args_os().skip(1)) {
        Ok(output) => {
            if !output.is_empty() {
                println!("{output}");
            }
        }
        Err(error) => {
            eprintln!("error: {error}");
            std::process::exit(1);
        }
    }
}
