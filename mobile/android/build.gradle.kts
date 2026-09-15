allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

gradle.afterProject {
    extensions.findByName("android")?.let { ext ->
        val method = ext.javaClass.methods.find {
            (it.name == "setCompileSdk" || it.name == "compileSdkVersion") &&
            it.parameterCount == 1 &&
            (it.parameterTypes[0] == Int::class.javaPrimitiveType || it.parameterTypes[0] == java.lang.Integer::class.java)
        }
        if (method != null) {
            method.invoke(ext, 36)
            println("[build.gradle.kts] afterProject: set compileSdk = 36 on :$name")
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
