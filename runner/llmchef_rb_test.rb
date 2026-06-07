#!/usr/bin/env ruby
require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'zip'
require_relative 'llmchef'

class LLMChefRunnerTest < Minitest::Test
  def test_extract_release_replaces_changed_files_and_removes_stale_files
    Dir.mktmpdir do |dir|
      temp_dir = File.join(dir, 'llmchef-app')
      zip_path = File.join(temp_dir, 'llmchef.zip')
      FileUtils.mkdir_p(temp_dir)

      create_zip(zip_path, {
        'index.html' => 'v1',
        'assets/app.js' => 'console.log("v1");',
        'stale.txt' => 'remove me'
      })
      LLMChefRunner.extract_release(zip_path, temp_dir)

      create_zip(zip_path, {
        'index.html' => 'v2',
        'assets/app.js' => 'console.log("v2");'
      })
      LLMChefRunner.extract_release(zip_path, temp_dir)

      assert_equal 'v2', File.read(File.join(temp_dir, 'index.html'))
      assert_equal 'console.log("v2");', File.read(File.join(temp_dir, 'assets/app.js'))
      refute File.exist?(File.join(temp_dir, 'stale.txt'))
    end
  end

  def test_extract_release_rejects_entries_that_escape_bundle_root
    Dir.mktmpdir do |dir|
      temp_dir = File.join(dir, 'llmchef-app')
      zip_path = File.join(temp_dir, 'llmchef.zip')
      escaped_path = File.join(dir, 'escaped.txt')
      FileUtils.mkdir_p(temp_dir)

      create_zip(zip_path, {'../escaped.txt' => 'ESCAPED'})

      error = assert_raises(RuntimeError) do
        LLMChefRunner.extract_release(zip_path, temp_dir)
      end

      assert_match(/escapes bundle root/, error.message)
      refute File.exist?(escaped_path)
    end
  end

  def test_resolve_request_path_rejects_traversal
    Dir.mktmpdir do |dir|
      temp_dir = File.join(dir, 'llmchef-app')
      FileUtils.mkdir_p(temp_dir)

      assert_nil LLMChefRunner.resolve_request_path(temp_dir, '/../etc/passwd')
      assert_nil LLMChefRunner.resolve_request_path(temp_dir, '/%2e%2e/secret.txt')
    end
  end

  def test_resolve_request_path_keeps_in_bundle_assets
    Dir.mktmpdir do |dir|
      temp_dir = File.join(dir, 'llmchef-app')
      FileUtils.mkdir_p(temp_dir)

      assert_equal temp_dir, LLMChefRunner.resolve_request_path(temp_dir, '/')
      assert_equal File.join(temp_dir, 'assets/app.js'),
                   LLMChefRunner.resolve_request_path(temp_dir, '/assets/app.js')
    end
  end

  def test_resolve_release_url_allows_only_default_or_loopback_overrides
    assert_equal LLMChefRunner::DEFAULT_RELEASE_URL, LLMChefRunner.resolve_release_url(nil)
    assert_equal 'http://127.0.0.1:4010/release/latest.zip',
                 LLMChefRunner.resolve_release_url('http://127.0.0.1:4010/release/latest.zip')

    error = assert_raises(RuntimeError) do
      LLMChefRunner.resolve_release_url('file:///etc/passwd')
    end

    assert_match(/loopback/, error.message)
  end

  private

  def create_zip(zip_path, entries)
    FileUtils.rm_f(zip_path)

    Zip::File.open(zip_path, create: true) do |zip|
      entries.each do |name, content|
        zip.get_output_stream(name) { |stream| stream.write(content) }
      end
    end
  end
end
