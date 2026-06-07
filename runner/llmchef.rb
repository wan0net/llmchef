#!/usr/bin/env ruby
require 'fileutils'
require 'pathname'
require 'ipaddr'
require 'zip'
require 'webrick'
require 'optparse'
require 'socket'
require 'net/http'
require 'uri'

module LLMChefRunner
  DEFAULT_RELEASE_URL = 'https://wan0.net/llmchef/release/latest.zip'

  module_function

  def parse_options(argv)
    options = {port: 3000, host: false}

    OptionParser.new do |opts|
      opts.banner = "Usage: ruby llmchef_server.rb [PORT] [options]"
      opts.on("--host", "Allow external connections") { |v| options[:host] = v }
    end.parse!(argv)

    options[:port] = argv[0].to_i if argv[0] && argv[0].to_i > 0
    options
  end

  def temp_dir(script_dir = File.dirname(File.expand_path(__FILE__)))
    ENV.fetch('LLMCHEF_RUNNER_APP_DIR', File.join(script_dir, 'llmchef-app'))
  end

  def resolve_release_url(raw_url = ENV['LLMCHEF_RELEASE_URL'])
    return DEFAULT_RELEASE_URL if raw_url.nil? || raw_url.empty?
    return raw_url if raw_url == DEFAULT_RELEASE_URL

    uri = URI.parse(raw_url)
    raise 'LLMCHEF_RELEASE_URL only supports http(s) loopback overrides.' unless %w[http https].include?(uri.scheme)
    raise 'LLMCHEF_RELEASE_URL must include a hostname.' if uri.host.nil? || uri.host.empty?
    return raw_url if uri.host == 'localhost'

    begin
      return raw_url if IPAddr.new(uri.host).loopback?
    rescue IPAddr::InvalidAddressError
      nil
    end

    raise 'LLMCHEF_RELEASE_URL must stay on the default release origin or a loopback host.'
  end

  def download_release(zip_path, release_url = resolve_release_url)
    allow_redirects = release_url == DEFAULT_RELEASE_URL
    current_uri = URI.parse(release_url)

    6.times do
      response = Net::HTTP.start(current_uri.host, current_uri.port, use_ssl: current_uri.scheme == 'https') do |http|
        http.request(Net::HTTP::Get.new(current_uri))
      end

      case response
      when Net::HTTPSuccess
        File.open(zip_path, 'wb') do |file|
          file.write(response.body)
        end
        return
      when Net::HTTPRedirection
        raise 'Redirects are not allowed for LLMCHEF_RELEASE_URL overrides.' unless allow_redirects
        location = response['location']
        raise 'Received redirect without Location header.' if location.nil? || location.empty?

        current_uri = URI.join(current_uri, location)
      else
        raise "Unexpected HTTP status #{response.code} while downloading LLMChef release."
      end
    end

    raise 'Too many redirects while downloading LLMChef release.'
  end

  def clear_previous_bundle(temp_dir, zip_path)
    Dir.children(temp_dir).each do |entry|
      entry_path = File.join(temp_dir, entry)
      next if File.expand_path(entry_path) == File.expand_path(zip_path)

      FileUtils.rm_rf(entry_path)
    end
  end

  def extract_release(zip_path, temp_dir)
    FileUtils.mkdir_p(temp_dir)
    clear_previous_bundle(temp_dir, zip_path)

    Zip::File.open(zip_path) do |zip|
      zip.each do |entry|
        entry_path = resolve_bundle_path(temp_dir, entry.name)
        raise "Archive entry escapes bundle root: #{entry.name}" unless entry_path

        if entry.directory?
          FileUtils.mkdir_p(entry_path)
          next
        end

        FileUtils.mkdir_p(File.dirname(entry_path))
        entry.get_input_stream do |input_stream|
          File.open(entry_path, 'wb') do |file|
            IO.copy_stream(input_stream, file)
          end
        end
      end
    end
  end

  def resolve_bundle_path(root_dir, relative_path)
    root_path = File.expand_path(root_dir)
    clean_relative = Pathname.new(relative_path).cleanpath.to_s
    return nil if clean_relative == '.'
    return nil if Pathname.new(relative_path).absolute?

    candidate = File.expand_path(File.join(root_path, clean_relative))
    prefix = "#{root_path}#{File::SEPARATOR}"

    candidate == root_path || candidate.start_with?(prefix) ? candidate : nil
  end

  def resolve_request_path(root_dir, request_path)
    request_path = WEBrick::HTTPUtils.unescape(request_path.to_s)
    relative_path = request_path.sub(%r{\A/+}, '')
    return nil if request_path.include?("\0")
    return File.expand_path(root_dir) if relative_path.empty?

    resolve_bundle_path(root_dir, relative_path)
  end

  def build_server(temp_dir, options)
    server_options = {
      Port: options[:port],
      DocumentRoot: temp_dir,
      BindAddress: options[:host] ? '0.0.0.0' : 'localhost'
    }

    server = WEBrick::HTTPServer.new(server_options)

    server.mount_proc '/' do |req, res|
      path = resolve_request_path(temp_dir, req.path)

      unless path
        res.status = 404
        res.body = 'Not found'
        next
      end

      if File.exist?(path) && !File.directory?(path)
        res.body = File.read(path)
        res.content_type = WEBrick::HTTPUtils.mime_type(path, WEBrick::HTTPUtils::DefaultMimeTypes)
      else
        res.body = File.read(File.join(temp_dir, 'index.html'))
        res.content_type = 'text/html'
      end
    end

    server
  end

  def access_message(options)
    ip = Socket.ip_address_list.find { |addr| addr.ipv4? && !addr.ipv4_loopback? }.ip_address
    if options[:host]
      "http://#{ip}:#{options[:port]} (accessible from other devices)"
    else
      "http://localhost:#{options[:port]} (local access only)"
    end
  rescue StandardError
    "http://localhost:#{options[:port]} (local access only)"
  end

  def run(argv = ARGV, script_dir = File.dirname(File.expand_path(__FILE__)))
    options = parse_options(argv)
    app_dir = temp_dir(script_dir)
    FileUtils.mkdir_p(app_dir)
    zip_path = File.join(app_dir, 'llmchef.zip')

    puts "Downloading LLMChef release..."
    download_release(zip_path)
    puts "Download complete. Extracting..."
    extract_release(zip_path, app_dir)
    FileUtils.rm(zip_path)
    puts "Extraction complete."

    server = build_server(app_dir, options)
    puts "LLMChef is running at #{access_message(options)}"
    trap('INT') { server.shutdown }
    server.start
  rescue StandardError => e
    FileUtils.rm(zip_path) if zip_path && File.exist?(zip_path)
    puts "Error: #{e.message}"
    exit 1
  end
end

LLMChefRunner.run if $PROGRAM_NAME == __FILE__
