# frozen_string_literal: true

module ThemeStore; end

class ThemeStore::GitImporter

  attr_reader :url

  def initialize(url, private_key: nil, branch: nil)
    @url = url
    if @url.start_with?("https://github.com") && !@url.end_with?(".git")
      @url = @url.gsub(/\/$/, '')
      @url += ".git"
    end
    @temp_folder = "#{Pathname.new(Dir.tmpdir).realpath}/discourse_theme_#{SecureRandom.hex}"
    @private_key = private_key
    @branch = branch
  end

  def import!
    if @private_key
      import_private!
    else
      import_public!
    end
  end

  def diff_local_changes(remote_theme_id)
    theme = Theme.find_by(remote_theme_id: remote_theme_id)
    raise Discourse::InvalidParameters.new(:id) unless theme
    local_version = theme.remote_theme&.local_version

    exporter = ThemeStore::ZipExporter.new(theme)
    local_temp_folder = exporter.export_to_folder

    Dir.chdir(@temp_folder) do
      Discourse::Utils.execute_command("git", "checkout", local_version)
      Discourse::Utils.execute_command("rm -rf ./*/")
      Discourse::Utils.execute_command("cp", "-rf", "#{local_temp_folder}/#{exporter.export_name}/.", @temp_folder)
      Discourse::Utils.execute_command("git", "checkout", "about.json")
      # add + diff staged to catch uploads but exclude renamed assets
      Discourse::Utils.execute_command("git", "add", "-A")
      return Discourse::Utils.execute_command("git", "diff", "--staged", "--diff-filter=r")
    end
  ensure
    FileUtils.rm_rf local_temp_folder if local_temp_folder
  end

  def commits_since(hash)
    commit_hash, commits_behind = nil

    Dir.chdir(@temp_folder) do
      commit_hash = Discourse::Utils.execute_command("git", "rev-parse", "HEAD").strip
      commits_behind = Discourse::Utils.execute_command("git", "rev-list", "#{hash}..HEAD", "--count").strip
    end

    [commit_hash, commits_behind]
  end

  def version
    Dir.chdir(@temp_folder) do
      Discourse::Utils.execute_command("git", "rev-parse", "HEAD").strip
    end
  end

  def cleanup!
    FileUtils.rm_rf(@temp_folder)
  end

  def real_path(relative)
    fullpath = "#{@temp_folder}/#{relative}"
    return nil unless File.exist?(fullpath)

    # careful to handle symlinks here, don't want to expose random data
    fullpath = Pathname.new(fullpath).realpath.to_s

    if fullpath && fullpath.start_with?(@temp_folder)
      fullpath
    else
      nil
    end
  end

  def all_files
    Dir.chdir(@temp_folder) do
      Dir.glob("**/*").reject { |f| File.directory?(f) }
    end
  end

  def [](value)
    fullpath = real_path(value)
    return nil unless fullpath
    File.read(fullpath)
  end

  protected

  def import_public!
    begin
      if @branch.present?
        Discourse::Utils.execute_command("git", "clone", "--single-branch", "-b", @branch, @url, @temp_folder)
      else
        Discourse::Utils.execute_command("git", "clone", @url, @temp_folder)
      end
    rescue RuntimeError => err
      raise RemoteTheme::ImportError.new(I18n.t("themes.import_error.git"))
    end
  end

  def import_private!
    ssh_folder = "#{Pathname.new(Dir.tmpdir).realpath}/discourse_theme_ssh_#{SecureRandom.hex}"
    FileUtils.mkdir_p ssh_folder

    Dir.chdir(ssh_folder) do
      File.write('id_rsa', @private_key.strip)
      FileUtils.chmod(0600, 'id_rsa')
    end

    begin
      git_ssh_command = { 'GIT_SSH_COMMAND' => "ssh -i #{ssh_folder}/id_rsa -o StrictHostKeyChecking=no" }
      if @branch.present?
        Discourse::Utils.execute_command(git_ssh_command, "git", "clone", "--single-branch", "-b", @branch, @url, @temp_folder)
      else
        Discourse::Utils.execute_command(git_ssh_command, "git", "clone", @url, @temp_folder)
      end
    rescue RuntimeError => err
      raise RemoteTheme::ImportError.new(I18n.t("themes.import_error.git"))
    end
  ensure
    FileUtils.rm_rf ssh_folder
  end

end
