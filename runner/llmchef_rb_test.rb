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
