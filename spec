%define        __spec_install_post %{nil}
%define          debug_package %{nil}
%define        __os_install_post %{_dbpath}/brp-compress

Summary: {{summary}}
Name: {{name}}
Version: {{version}}
Release: 1
License: GPL+
Group: Development/Tools
{{sources}}
URL: {{url}}

BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

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


%clean
rm -rf %{buildroot}


%files
{{files}}