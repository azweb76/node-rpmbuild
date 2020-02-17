%define        _binaries_in_noarch_packages_terminate_build   0
%define        __spec_install_post %{nil}
%define          debug_package %{nil}
%define        __os_install_post %{_dbpath}/brp-compress

Summary: {{summary}}
Name: {{name}}
Version: {{version}}
Release: {{release}}
License: {{license}}
Group: {{group}}
{{sources}}
URL: {{url}}

{{requires}}

BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

BuildArch: {{buildArch}}

%description
{{description}}

%prep
%setup -q

%build
# Empty section.

%install
rm -rf %{buildroot}
mkdir -p  %{buildroot}

# in builddir
cp -a * %{buildroot}

{{installScript}}

%clean
rm -rf %{buildroot}

%files
{{files}}
